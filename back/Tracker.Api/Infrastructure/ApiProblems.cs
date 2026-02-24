using Microsoft.AspNetCore.Mvc;

namespace Tracker.Api.Infrastructure;

public static class ApiProblems
{
    public static ObjectResult BadRequest(
        ControllerBase controller,
        string code,
        string title,
        string? detail = null,
        IReadOnlyDictionary<string, object?>? meta = null)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = title,
            Detail = detail,
            Type = "https://httpstatuses.com/400",
            Instance = controller.HttpContext?.Request?.Path.Value
        };

        problem.Extensions["code"] = code;

        if (meta is not null)
        {
            foreach (var item in meta)
                problem.Extensions[item.Key] = item.Value;
        }

        return new ObjectResult(problem) { StatusCode = StatusCodes.Status400BadRequest };
    }
}
