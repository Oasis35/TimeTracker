namespace Tracker.Api.Infrastructure;

public static class ApiErrorCodes
{
    public const string UnknownError = "TT_UNKNOWN_ERROR";
    public const string MonthInvalid = "TT_MONTH_INVALID";
    public const string ConfigHoursPerDayInvalid = "TT_CONFIG_HOURS_PER_DAY_INVALID";
    public const string ConfigMinutesPerDayInvalid = "TT_CONFIG_MINUTES_PER_DAY_INVALID";
    public const string TicketIdInvalid = "TT_TICKET_ID_INVALID";
    public const string TicketNotFound = "TT_TICKET_NOT_FOUND";
    public const string TicketTypeRequired = "TT_TICKET_TYPE_REQUIRED";
    public const string TicketLabelRequired = "TT_TICKET_LABEL_REQUIRED";
    public const string FilterYearMonthRequired = "TT_FILTER_YEAR_MONTH_REQUIRED";
    public const string MinutesOutOfRange = "TT_MINUTES_OUT_OF_RANGE";
    public const string Step15 = "TT_STEP_15";
    public const string OverflowDay = "TT_OVERFLOW_DAY";
}
