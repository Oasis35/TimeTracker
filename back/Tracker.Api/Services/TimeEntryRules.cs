namespace Tracker.Api.Services;

public sealed record TimeEntryValidationError(
    string Code,
    string Title,
    string? Detail = null,
    IReadOnlyDictionary<string, object?>? Meta = null);

public static class TimeEntryRules
{
    public const int StepMinutes = 15;

    public static TimeEntryValidationError? Validate(
        int ticketId,
        int quantityMinutes,
        int minutesPerDay,
        int dayTotalMinutes,
        int existingMinutes)
    {
        if (ticketId <= 0)
        {
            return new TimeEntryValidationError(
                Code: "TT_TICKET_ID_INVALID",
                Title: "L'id du ticket est invalide.");
        }

        if (quantityMinutes < 0 || quantityMinutes > minutesPerDay)
        {
            return new TimeEntryValidationError(
                Code: "TT_MINUTES_OUT_OF_RANGE",
                Title: "La quantite de minutes est hors bornes.",
                Detail: $"Attendu: 0..{minutesPerDay}.");
        }

        if (quantityMinutes % StepMinutes != 0)
        {
            return new TimeEntryValidationError(
                Code: "TT_STEP_15",
                Title: "La quantite de minutes doit respecter un pas de 15.");
        }

        var newTotal = dayTotalMinutes - existingMinutes + quantityMinutes;
        if (newTotal > minutesPerDay)
        {
            return new TimeEntryValidationError(
                Code: "TT_OVERFLOW_DAY",
                Title: "Le total du jour depasse la limite autorisee.",
                Detail: $"Total calcule: {newTotal}/{minutesPerDay} minutes.",
                Meta: new Dictionary<string, object?>
                {
                    ["newTotal"] = newTotal,
                    ["minutesPerDay"] = minutesPerDay
                });
        }

        return null;
    }
}

