using Tracker.Api.Services;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TimeEntryRulesTests
{
    [Fact]
    public void Validate_Should_Return_Null_When_Input_Is_Valid()
    {
        var error = TimeEntryRules.Validate(
            ticketId: 10,
            quantityMinutes: 120,
            minutesPerDay: 480,
            dayTotalMinutes: 240,
            existingMinutes: 60);

        Assert.Null(error);
    }

    [Fact]
    public void Validate_Should_Return_TT_TICKET_ID_INVALID()
    {
        var error = TimeEntryRules.Validate(
            ticketId: 0,
            quantityMinutes: 120,
            minutesPerDay: 480,
            dayTotalMinutes: 0,
            existingMinutes: 0);

        Assert.NotNull(error);
        Assert.Equal("TT_TICKET_ID_INVALID", error!.Code);
    }

    [Fact]
    public void Validate_Should_Return_TT_STEP_15()
    {
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: 7,
            minutesPerDay: 480,
            dayTotalMinutes: 0,
            existingMinutes: 0);

        Assert.NotNull(error);
        Assert.Equal("TT_STEP_15", error!.Code);
    }

    [Fact]
    public void Validate_Should_Return_TT_OVERFLOW_DAY()
    {
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: 300,
            minutesPerDay: 480,
            dayTotalMinutes: 420,
            existingMinutes: 0);

        Assert.NotNull(error);
        Assert.Equal("TT_OVERFLOW_DAY", error!.Code);
    }
}
