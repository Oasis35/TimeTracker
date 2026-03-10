using Tracker.Api.Models;

namespace Tracker.Api.Dtos.Tickets;

public sealed record TicketDto(int Id, TicketType Type, string? ExternalKey, string? Label, bool IsCompleted);

public sealed record SaveTicketDto(TicketType Type, string? ExternalKey, string? Label);

public sealed record SetTicketCompletionDto(bool IsCompleted);
