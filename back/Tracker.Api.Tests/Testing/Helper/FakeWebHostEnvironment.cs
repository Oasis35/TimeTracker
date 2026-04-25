using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace Tracker.Api.Tests.Testing;

public sealed class FakeWebHostEnv : IWebHostEnvironment
{
    public FakeWebHostEnv(string contentRootPath)
    {
        ContentRootPath = contentRootPath;
    }

    public string ApplicationName { get; set; } = "Tracker.Api.Tests";
    public IFileProvider WebRootFileProvider { get; set; } = null!;
    public string WebRootPath { get; set; } = string.Empty;
    public string EnvironmentName { get; set; } = "Testing";
    public string ContentRootPath { get; set; }
    public IFileProvider ContentRootFileProvider { get; set; } = null!;
}
