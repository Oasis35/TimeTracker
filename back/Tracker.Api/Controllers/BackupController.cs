using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Tracker.Api.Infrastructure;
using Tracker.Api.Services;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/backup")]
[EnableRateLimiting("backup")]
public sealed class BackupController : ControllerBase
{
    private readonly DatabaseBackupService _backupService;

    public BackupController(DatabaseBackupService backupService)
    {
        _backupService = backupService;
    }

    [HttpPost("export")]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        var payload = await _backupService.ExportAsync(cancellationToken);
        return File(payload.Content, "application/octet-stream", payload.FileName);
    }

    [HttpPost("restore")]
    [RequestFormLimits(MultipartBodyLengthLimit = 262_144_000)]
    public async Task<ActionResult<object>> Restore([FromForm] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length <= 0)
            return ApiProblems.BadRequest(this, ApiErrorCodes.BackupFileMissing);
        if (!string.Equals(Path.GetExtension(file.FileName), ".db", StringComparison.OrdinalIgnoreCase))
            return ApiProblems.BadRequest(this, ApiErrorCodes.BackupFileInvalid);

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await _backupService.RestoreAsync(stream, cancellationToken);
            return Ok(new { result.SafetyBackupFileName });
        }
        catch (InvalidBackupException)
        {
            return ApiProblems.BadRequest(this, ApiErrorCodes.BackupFileInvalid);
        }
    }
}
