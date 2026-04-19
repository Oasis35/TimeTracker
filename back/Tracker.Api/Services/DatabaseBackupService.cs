using Microsoft.Data.Sqlite;

namespace Tracker.Api.Services;

public sealed class DatabaseBackupService
{
    private static readonly string[] RequiredTables = ["Tickets", "TimeEntries"];

    private readonly string _databasePath;
    private readonly string _backupsDirectory;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public DatabaseBackupService(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("Main")
            ?? throw new InvalidOperationException("Main connection string is missing.");
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.DataSource) || builder.DataSource == ":memory:")
            throw new InvalidOperationException("Backup requires a file-based SQLite database.");

        _databasePath = Path.IsPathRooted(builder.DataSource)
            ? builder.DataSource
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, builder.DataSource));
        _backupsDirectory = Path.Combine(Path.GetDirectoryName(_databasePath) ?? environment.ContentRootPath, "backups");
    }

    public async Task<BackupExportPayload> ExportAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        var timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
        var tempPath = Path.Combine(_backupsDirectory, $"export-{timestamp}-{Guid.NewGuid():N}.db");

        try
        {
            EnsureDatabaseExists();
            Directory.CreateDirectory(_backupsDirectory);
            await BackupDatabaseAsync(_databasePath, tempPath);

            var content = await File.ReadAllBytesAsync(tempPath, cancellationToken);
            return new BackupExportPayload($"timetracker-backup-{timestamp}.db", content);
        }
        finally
        {
            _gate.Release();
            await TryDeleteAsync(tempPath);
        }
    }

    public async Task<BackupRestoreResult> RestoreAsync(Stream backupStream, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        var timestamp = DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss");
        var uploadedPath = Path.Combine(_backupsDirectory, $"restore-upload-{timestamp}-{Guid.NewGuid():N}.db");
        var safetyBackupFileName = $"pre-restore-{timestamp}.db";
        var safetyBackupPath = Path.Combine(_backupsDirectory, safetyBackupFileName);

        try
        {
            EnsureDatabaseExists();
            Directory.CreateDirectory(_backupsDirectory);

            await using (var fileStream = new FileStream(uploadedPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await backupStream.CopyToAsync(fileStream, cancellationToken);
            }

            if (!await IsValidBackupAsync(uploadedPath, cancellationToken))
                throw new InvalidBackupException();

            await BackupDatabaseAsync(_databasePath, safetyBackupPath);
            await BackupDatabaseAsync(uploadedPath, _databasePath);

            return new BackupRestoreResult(safetyBackupFileName);
        }
        finally
        {
            _gate.Release();
            await TryDeleteAsync(uploadedPath);
        }
    }

    private async Task BackupDatabaseAsync(string sourcePath, string destinationPath)
    {
        var destinationDirectory = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrWhiteSpace(destinationDirectory))
            Directory.CreateDirectory(destinationDirectory);

        await TryDeleteAsync(destinationPath);

        try
        {
            using var source = OpenConnection(sourcePath);
            using var destination = OpenConnection(destinationPath);
            source.Open();
            destination.Open();
            source.BackupDatabase(destination);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
        }
    }

    private async Task<bool> IsValidBackupAsync(string backupPath, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = OpenConnection(backupPath);
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table';";

            var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                tables.Add(reader.GetString(0));
            }

            return RequiredTables.All(tables.Contains);
        }
        catch
        {
            return false;
        }
    }

    private SqliteConnection OpenConnection(string path)
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = SqliteOpenMode.ReadWriteCreate,
        };

        return new SqliteConnection(builder.ToString());
    }

    private void EnsureDatabaseExists()
    {
        if (!File.Exists(_databasePath))
            throw new FileNotFoundException("SQLite database file was not found.", _databasePath);
    }

    private static async Task TryDeleteAsync(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return;

        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                File.Delete(path);
                return;
            }
            catch (IOException)
            {
                if (attempt == 4) return;
                await Task.Delay(50);
            }
            catch (UnauthorizedAccessException)
            {
                if (attempt == 4) return;
                await Task.Delay(50);
            }
        }
    }
}

public sealed record BackupExportPayload(string FileName, byte[] Content);

public sealed record BackupRestoreResult(string SafetyBackupFileName);

public sealed class InvalidBackupException : Exception;
