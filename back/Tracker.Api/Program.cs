using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<TrackerDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Main")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularDev", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.Configure<TimeTrackingOptions>(
    builder.Configuration.GetSection("TimeTracking"));

var app = builder.Build();

// ✅ Ne rien faire en tests (factory contrôle la DB)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();

    if (!db.Database.CanConnect())
        return;

    db.Database.Migrate();

    // ✅ Seed seulement en dev
    if (app.Environment.IsDevelopment())
    {
        var opts = scope.ServiceProvider.GetRequiredService<IOptions<TimeTrackingOptions>>().Value;
        DbSeeder.SeedDevelopmentData(db, opts);
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseHttpsRedirection(); // OK en dev
}
else
{
    // En docker/prod, souvent HTTP only derrière reverse-proxy
    // Si tu veux forcer HTTPS, fais-le via le reverse proxy (Traefik/Nginx) plutôt.
}

app.UseCors("AngularDev");
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program { }