using Microsoft.AspNetCore.Mvc;

namespace Tracker.Api.Infrastructure;

public sealed record ApiErrorResponse(string Code);

public static class ApiProblems
{
    public static ObjectResult BadRequest(ControllerBase _, string code)
    {
        var payload = new ApiErrorResponse(code);
        return new ObjectResult(payload) { StatusCode = StatusCodes.Status400BadRequest };
    }

    public static ObjectResult NotFound(ControllerBase _, string code)
    {
        var payload = new ApiErrorResponse(code);
        return new ObjectResult(payload) { StatusCode = StatusCodes.Status404NotFound };
    }

    public static ObjectResult Conflict(ControllerBase _, string code)
    {
        var payload = new ApiErrorResponse(code);
        return new ObjectResult(payload) { StatusCode = StatusCodes.Status409Conflict };
    }
}
