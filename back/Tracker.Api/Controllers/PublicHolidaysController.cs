using Microsoft.AspNetCore.Mvc;
using Tracker.Api.Services;

namespace Tracker.Api.Controllers;

[ApiController]
[Route("api/public-holidays")]
public sealed class PublicHolidaysController(PublicHolidaysService holidays) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Dictionary<string, string>>> Get(CancellationToken ct)
        => Ok(await holidays.GetAsync(ct));
}
