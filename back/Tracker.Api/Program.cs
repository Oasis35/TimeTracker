using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tracker.Api.Data;
using Tracker.Api.Infrastructure;
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

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionFeature = context.Features.Get<IExceptionHandlerFeature>();
        var errorCode = ApiErrorCodes.UnknownError;
        var errorDetail = exceptionFeature?.Error?.ToString();
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("GlobalExceptionHandler");

        logger.LogError(
            exceptionFeature?.Error,
            "Unhandled exception. Code={Code} Detail={Detail} Method={Method} Path={Path} Query={Query} TraceId={TraceId}",
            errorCode,
            errorDetail,
            context.Request.Method,
            context.Request.Path,
            context.Request.QueryString.Value,
            context.TraceIdentifier);

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        var payload = JsonSerializer.Serialize(new ApiErrorResponse(errorCode));
        await context.Response.WriteAsync(payload);
    });
});

// Ne rien faire en tests (factory controle la DB)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<TrackerDbContext>();
    var hasMigrations = db.Database.GetMigrations().Any();
    if (hasMigrations)
        db.Database.Migrate();
    else
        db.Database.EnsureCreated();

    // Seed seulement en dev
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
    // En docker/prod, souvent HTTP only derriere reverse-proxy
    // Si tu veux forcer HTTPS, fais-le via le reverse proxy (Traefik/Nginx) plutot.
}

app.UseCors("AngularDev");
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program { }
