using System.Text.Json.Serialization;

namespace Tracker.Api.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketType
{
    ABSENT = 0,
    DEV = 10,
    SUPPORT = 20
}
