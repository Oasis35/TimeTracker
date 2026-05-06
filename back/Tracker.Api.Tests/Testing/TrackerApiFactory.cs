using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Data.Common;
using Tracker.Api.Data;
using Tracker.Api.Models;

namespace Tracker.Api.Tests.Testing;

public sealed class TrackerApiFactory : WebApplicationFactory<Program>
{
    private DbConnection? _connection;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<TrackerDbContext>));

            if (descriptor is not null)
                services.Remove(descriptor);

            _connection = new SqliteConnection("Data Source=:memory:;Cache=Shared");
            _connection.Open();

            services.AddDbContext<TrackerDbContext>(options =>
            {
                options.UseSqlite(_connection);
            });

            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
            db.Database.EnsureCreated();
            db.AppSettings.Add(new AppSetting { Key = AppSettingKeys.MinutesPerDay, Value = "480" });
            db.SaveChanges();
        });
    }

    public async Task ResetDbAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
        db.TimeEntries.RemoveRange(db.TimeEntries);
        db.Tickets.RemoveRange(db.Tickets);
        db.AppSettings.RemoveRange(db.AppSettings);
        await db.SaveChangesAsync();
        db.AppSettings.Add(new AppSetting { Key = AppSettingKeys.MinutesPerDay, Value = "480" });
        await db.SaveChangesAsync();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection?.Dispose();
            _connection = null;
        }
    }
}
