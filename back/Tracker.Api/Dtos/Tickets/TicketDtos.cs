using System.ComponentModel.DataAnnotations;
using Tracker.Api.Models;

namespace Tracker.Api.Dtos.Tickets;

public sealed record TicketDto(int Id, TicketType Type, string? ExternalKey, string? Label);

public sealed record SaveTicketDto(
    TicketType Type,
    [MaxLength(100)] string? ExternalKey,
    [MaxLength(255)] string? Label);
