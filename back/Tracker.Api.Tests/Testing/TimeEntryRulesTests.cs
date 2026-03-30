using Tracker.Api.Services;
using Tracker.Api.Infrastructure;
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
        Assert.Equal(ApiErrorCodes.TicketIdInvalid, error!.Code);
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
        Assert.Equal(ApiErrorCodes.Step15, error!.Code);
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
        Assert.Equal(ApiErrorCodes.OverflowDay, error!.Code);
    }

    [Fact]
    public void Validate_Should_Return_Null_When_QuantityMinutes_Is_Zero()
    {
        // Zero is valid: it represents deletion of a time entry
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: 0,
            minutesPerDay: 480,
            dayTotalMinutes: 240,
            existingMinutes: 120);

        Assert.Null(error);
    }

    [Fact]
    public void Validate_Should_Return_Null_When_QuantityMinutes_Equals_MinutesPerDay()
    {
        // Exactly at the daily limit should be accepted
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: 480,
            minutesPerDay: 480,
            dayTotalMinutes: 0,
            existingMinutes: 0);

        Assert.Null(error);
    }

    [Fact]
    public void Validate_Should_Return_TT_MINUTES_OUT_OF_RANGE_When_Negative()
    {
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: -15,
            minutesPerDay: 480,
            dayTotalMinutes: 0,
            existingMinutes: 0);

        Assert.NotNull(error);
        Assert.Equal(ApiErrorCodes.MinutesOutOfRange, error!.Code);
    }

    [Fact]
    public void Validate_Should_Return_Null_When_Updating_Existing_Entry_Without_Overflow()
    {
        // Day total is 480 but 240 belongs to the entry being updated,
        // so effective new total = 480 - 240 + 240 = 480 → exactly at limit, valid
        var error = TimeEntryRules.Validate(
            ticketId: 1,
            quantityMinutes: 240,
            minutesPerDay: 480,
            dayTotalMinutes: 480,
            existingMinutes: 240);

        Assert.Null(error);
    }
}
