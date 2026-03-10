using Tracker.Api.Infrastructure;

namespace Tracker.Api.Services;

public sealed record TimeEntryValidationError(
    string Code);

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
                Code: ApiErrorCodes.TicketIdInvalid);
        }

        if (quantityMinutes < 0 || quantityMinutes > minutesPerDay)
        {
            return new TimeEntryValidationError(
                Code: ApiErrorCodes.MinutesOutOfRange);
        }

        if (quantityMinutes % StepMinutes != 0)
        {
            return new TimeEntryValidationError(
                Code: ApiErrorCodes.Step15);
        }

        var newTotal = dayTotalMinutes - existingMinutes + quantityMinutes;
        if (newTotal > minutesPerDay)
        {
            return new TimeEntryValidationError(
                Code: ApiErrorCodes.OverflowDay);
        }

        return null;
    }
}
