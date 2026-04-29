using System.ComponentModel.DataAnnotations;

namespace Tracker.Api.Dtos.Settings;

public record UpsertSettingDto([MaxLength(1000)] string Value);
