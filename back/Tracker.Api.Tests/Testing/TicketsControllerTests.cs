using Microsoft.AspNetCore.Mvc;
using Tracker.Api.Controllers;
using Tracker.Api.Dtos.Tickets;
using Tracker.Api.Infrastructure;
using Tracker.Api.Models;
using Tracker.Api.Tests.Testing;
using Xunit;

namespace Tracker.Api.Tests;

public sealed class TicketsControllerTests
{
    // -------------------------
    // GET /api/tickets
    // -------------------------

    [Fact]
    public async Task GetAll_Should_Return_Ordered_By_Type_Then_ExternalKey()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        db.Tickets.AddRange(
            new Ticket { Type = "B", ExternalKey = "2", Label = "B2" },
            new Ticket { Type = "A", ExternalKey = "9", Label = "A9" },
            new Ticket { Type = "A", ExternalKey = "1", Label = "A1" },
            new Ticket { Type = "B", ExternalKey = null, Label = null }
        );
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetAll();
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<TicketDto>>(ok.Value);

        Assert.Equal(4, list.Count);

        // Ordering: Type A then B ; within A: ExternalKey 1 then 9 ; within B: null then 2 ? (Attention: ordre des nulls dépend du provider)
        // SQLite trie généralement NULL avant texte en ORDER BY ASC.
        Assert.Equal("A", list[0].Type);
        Assert.Equal("1", list[0].ExternalKey);

        Assert.Equal("A", list[1].Type);
        Assert.Equal("9", list[1].ExternalKey);

        Assert.Equal("B", list[2].Type);
        Assert.Null(list[2].ExternalKey);

        Assert.Equal("B", list[3].Type);
        Assert.Equal("2", list[3].ExternalKey);
    }

    [Fact]
    public async Task GetAll_Should_Exclude_Conges_Type()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        db.Tickets.AddRange(
            new Ticket { Type = "CONGES", ExternalKey = "CP-ETE", Label = "Conges ete" },
            new Ticket { Type = "DEV", ExternalKey = "65010", Label = "Refonte auth API" }
        );
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetAll();
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<TicketDto>>(ok.Value);

        Assert.Single(list);
        Assert.Equal("DEV", list[0].Type);
    }

    // -------------------------
    // POST /api/tickets
    // -------------------------

    [Fact]
    public async Task Create_Should_Return_BadRequest_When_Type_Is_Missing()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Create(new CreateTicketDto(Type: "   ", ExternalKey: null, Label: null));

        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketTypeRequired, error.Code);
    }

    [Fact]
    public async Task Create_Should_Return_BadRequest_When_ExternalKey_Provided_But_Label_Missing()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Create(new CreateTicketDto(Type: "JIRA", ExternalKey: "ABC-1", Label: "   "));

        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketLabelRequired, error.Code);
    }

    [Fact]
    public async Task Create_Should_Trim_Inputs_And_Create_Ticket()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Create(new CreateTicketDto(
            Type: "  JIRA  ",
            ExternalKey: "  ABC-123  ",
            Label: "  ABC-123 - Login bug  "));

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(created.Value);

        Assert.True(dto.Id > 0);
        Assert.Equal("JIRA", dto.Type);
        Assert.Equal("ABC-123", dto.ExternalKey);
        Assert.Equal("ABC-123 - Login bug", dto.Label);

        var entity = db.Tickets.Single(t => t.Id == dto.Id);
        Assert.Equal("JIRA", entity.Type);
        Assert.Equal("ABC-123", entity.ExternalKey);
        Assert.Equal("ABC-123 - Login bug", entity.Label);
    }

    [Fact]
    public async Task Create_Should_Return_Existing_When_Type_And_ExternalKey_Already_Exist()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var existing = new Ticket { Type = "JIRA", ExternalKey = "ABC-123", Label = "Old label" };
        db.Tickets.Add(existing);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        // Label différent -> doit retourner l'existant, sans créer un doublon
        var result = await controller.Create(new CreateTicketDto(
            Type: "JIRA",
            ExternalKey: "ABC-123",
            Label: "New label"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(ok.Value);

        Assert.Equal(existing.Id, dto.Id);
        Assert.Equal("Old label", dto.Label);

        Assert.Equal(1, db.Tickets.Count());
    }

    [Fact]
    public async Task Create_Should_Create_When_ExternalKey_Is_Null_Even_If_Type_Same()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        db.Tickets.Add(new Ticket { Type = "GEN", ExternalKey = null, Label = "L1" });
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        // externalKey null => ton code ne "dedupe" pas (il dedupe uniquement si externalKey != null)
        var result = await controller.Create(new CreateTicketDto(Type: "GEN", ExternalKey: null, Label: "L2"));

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(created.Value);

        Assert.Equal("GEN", dto.Type);
        Assert.Null(dto.ExternalKey);
        Assert.Equal("L2", dto.Label);

        Assert.Equal(2, db.Tickets.Count());
    }

    // -------------------------
    // PUT /api/tickets/{id}
    // -------------------------

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_TicketId_Is_Invalid()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Update(0, new CreateTicketDto("DEV", "X-1", "Label"));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketIdInvalid, error.Code);
    }

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_Ticket_Not_Found()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Update(999, new CreateTicketDto("DEV", "X-1", "Label"));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketNotFound, error.Code);
    }

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_Type_Is_Missing()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "Label" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Update(ticket.Id, new CreateTicketDto("   ", "X-1", "Label"));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketTypeRequired, error.Code);
    }

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_ExternalKey_Provided_But_Label_Missing()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "Label" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Update(ticket.Id, new CreateTicketDto("DEV", "X-1", "   "));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketLabelRequired, error.Code);
    }

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_Type_And_ExternalKey_Duplicate_Another_Ticket()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t1 = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "L1" };
        var t2 = new Ticket { Type = "DEV", ExternalKey = "X-2", Label = "L2" };
        db.Tickets.AddRange(t1, t2);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Update(t2.Id, new CreateTicketDto("DEV", "X-1", "New label"));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketAlreadyExists, error.Code);
    }

    [Fact]
    public async Task Update_Should_Trim_And_Save_Ticket()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "Old" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Update(ticket.Id, new CreateTicketDto("  CONGES  ", "  RTT-1  ", "  Nouveau  "));
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(ok.Value);

        Assert.Equal(ticket.Id, dto.Id);
        Assert.Equal("CONGES", dto.Type);
        Assert.Equal("RTT-1", dto.ExternalKey);
        Assert.Equal("Nouveau", dto.Label);

        var reloaded = db.Tickets.Single(t => t.Id == ticket.Id);
        Assert.Equal("CONGES", reloaded.Type);
        Assert.Equal("RTT-1", reloaded.ExternalKey);
        Assert.Equal("Nouveau", reloaded.Label);
    }

    [Fact]
    public async Task Update_Should_Return_BadRequest_When_Ticket_Is_Completed()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "Label", IsCompleted = true };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Update(ticket.Id, new CreateTicketDto("DEV", "X-1", "Updated"));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketCompletedLocked, error.Code);
    }

    // -------------------------
    // PATCH /api/tickets/{id}/completion
    // -------------------------

    [Fact]
    public async Task SetCompletion_Should_Return_BadRequest_When_TicketId_Is_Invalid()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.SetCompletion(0, new SetTicketCompletionDto(true));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketIdInvalid, error.Code);
    }

    [Fact]
    public async Task SetCompletion_Should_Return_BadRequest_When_Ticket_Not_Found()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.SetCompletion(999, new SetTicketCompletionDto(true));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketNotFound, error.Code);
    }

    [Fact]
    public async Task SetCompletion_Should_Update_Flag_To_True()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1", IsCompleted = false };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();
        db.TimeEntries.Add(new TimeEntry
        {
            TicketId = ticket.Id,
            Date = new DateOnly(2026, 2, 1),
            QuantityMinutes = 60
        });
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.SetCompletion(ticket.Id, new SetTicketCompletionDto(true));
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(ok.Value);

        Assert.True(dto.IsCompleted);
        Assert.True(db.Tickets.Single(t => t.Id == ticket.Id).IsCompleted);
    }

    [Fact]
    public async Task SetCompletion_Should_Update_Flag_To_False()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1", IsCompleted = true };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.SetCompletion(ticket.Id, new SetTicketCompletionDto(false));
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<TicketDto>(ok.Value);

        Assert.False(dto.IsCompleted);
        Assert.False(db.Tickets.Single(t => t.Id == ticket.Id).IsCompleted);
    }

    [Fact]
    public async Task SetCompletion_Should_Return_BadRequest_When_Setting_Completed_And_No_TimeEntries()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1", IsCompleted = false };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.SetCompletion(ticket.Id, new SetTicketCompletionDto(true));
        var bad = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketNoTimeEntries, error.Code);

        Assert.False(db.Tickets.Single(t => t.Id == ticket.Id).IsCompleted);
    }

    // -------------------------
    // DELETE /api/tickets/{id}
    // -------------------------

    [Fact]
    public async Task Delete_Should_Return_BadRequest_When_TicketId_Is_Invalid()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Delete(0);
        var bad = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketIdInvalid, error.Code);
    }

    [Fact]
    public async Task Delete_Should_Return_BadRequest_When_Ticket_Not_Found()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Delete(999);
        var bad = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketNotFound, error.Code);
    }

    [Fact]
    public async Task Delete_Should_Return_BadRequest_When_Ticket_Has_TimeEntries()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        db.TimeEntries.Add(new TimeEntry
        {
            TicketId = ticket.Id,
            Date = new DateOnly(2026, 2, 1),
            QuantityMinutes = 60
        });
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Delete(ticket.Id);
        var bad = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketHasTimeEntries, error.Code);

        Assert.Equal(1, db.Tickets.Count());
    }

    [Fact]
    public async Task Delete_Should_Remove_Ticket_When_No_TimeEntry_Exists()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Delete(ticket.Id);
        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task Delete_Should_Return_BadRequest_When_Ticket_Is_Completed()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var ticket = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1", IsCompleted = true };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.Delete(ticket.Id);
        var bad = Assert.IsType<ObjectResult>(result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.TicketCompletedLocked, error.Code);
    }

    // -------------------------
    // GET /api/tickets/totals
    // -------------------------

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public async Task GetUsedByMonth_Should_Return_BadRequest_When_Month_Invalid(int month)
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var r = await controller.GetUsedByMonth(year: 2026, month: month);
        var bad = Assert.IsType<ObjectResult>(r.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.MonthInvalid, error.Code);
    }

    [Fact]
    public async Task GetUsedByMonth_Should_Return_Only_Tickets_With_TimeEntries_In_Selected_Month()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t1 = new Ticket { Type = "B", ExternalKey = "2", Label = "B2" };
        var t2 = new Ticket { Type = "A", ExternalKey = "1", Label = "A1" };
        var t3 = new Ticket { Type = "A", ExternalKey = "9", Label = "A9" };
        db.Tickets.AddRange(t1, t2, t3);
        await db.SaveChangesAsync();

        db.TimeEntries.AddRange(
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 3), QuantityMinutes = 60 },
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 4), QuantityMinutes = 30 },
            new TimeEntry { TicketId = t2.Id, Date = new DateOnly(2026, 2, 10), QuantityMinutes = 90 },
            new TimeEntry { TicketId = t3.Id, Date = new DateOnly(2026, 3, 1), QuantityMinutes = 45 }
        );
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetUsedByMonth(year: 2026, month: 2);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<TicketDto>>(ok.Value);

        Assert.Equal(2, list.Count);
        Assert.Equal(t2.Id, list[0].Id); // ordered by Type then ExternalKey
        Assert.Equal(t1.Id, list[1].Id);
    }

    [Fact]
    public async Task GetUsedByMonth_Should_Return_Empty_When_No_TimeEntries_In_Selected_Month()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t1 = new Ticket { Type = "DEV", ExternalKey = "X-1", Label = "X1" };
        db.Tickets.Add(t1);
        await db.SaveChangesAsync();

        db.TimeEntries.Add(new TimeEntry
        {
            TicketId = t1.Id,
            Date = new DateOnly(2026, 3, 1),
            QuantityMinutes = 60
        });
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetUsedByMonth(year: 2026, month: 2);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<TicketDto>>(ok.Value);

        Assert.Empty(list);
    }

    [Fact]
    public async Task GetTotals_Should_Return_BadRequest_When_Only_Year_Or_Only_Month()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var r1 = await controller.GetTotals(year: 2026, month: null);
        var bad1 = Assert.IsType<ObjectResult>(r1.Result);
        Assert.Equal(400, bad1.StatusCode);
        var p1 = Assert.IsType<ApiErrorResponse>(bad1.Value);
        Assert.Equal(ApiErrorCodes.FilterYearMonthRequired, p1.Code);

        var r2 = await controller.GetTotals(year: null, month: 2);
        var bad2 = Assert.IsType<ObjectResult>(r2.Result);
        Assert.Equal(400, bad2.StatusCode);
        var p2 = Assert.IsType<ApiErrorResponse>(bad2.Value);
        Assert.Equal(ApiErrorCodes.FilterYearMonthRequired, p2.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public async Task GetTotals_Should_Return_BadRequest_When_Month_Invalid(int month)
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var r = await controller.GetTotals(year: 2026, month: month);
        var bad = Assert.IsType<ObjectResult>(r.Result);
        Assert.Equal(400, bad.StatusCode);
        var error = Assert.IsType<ApiErrorResponse>(bad.Value);
        Assert.Equal(ApiErrorCodes.MonthInvalid, error.Code);
    }

    [Fact]
    public async Task GetTotals_Should_Return_Totals_For_All_Time_When_No_Filter()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t1 = new Ticket { Type = "JIRA", ExternalKey = "A-1", Label = "A1" };
        var t2 = new Ticket { Type = "JIRA", ExternalKey = "A-2", Label = "A2" };
        db.Tickets.AddRange(t1, t2);
        await db.SaveChangesAsync();

        db.TimeEntries.AddRange(
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 1), QuantityMinutes = 30, Comment = null },
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 2), QuantityMinutes = 15, Comment = null },
            new TimeEntry { TicketId = t2.Id, Date = new DateOnly(2026, 2, 1), QuantityMinutes = 60, Comment = null }
        );
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetTotals(year: null, month: null);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsType<List<TicketTotalDto>>(ok.Value);

        Assert.Equal(2, list.Count);

        // tri: Total desc => t2 (60) puis t1 (45)
        Assert.Equal(t2.Id, list[0].TicketId);
        Assert.Equal(60, list[0].Total);

        Assert.Equal(t1.Id, list[1].TicketId);
        Assert.Equal(45, list[1].Total);
    }

    [Fact]
    public async Task GetTotals_Should_Filter_By_Month_When_Year_And_Month_Provided()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t1 = new Ticket { Type = "JIRA", ExternalKey = "A-1", Label = "A1" };
        db.Tickets.Add(t1);
        await db.SaveChangesAsync();

        db.TimeEntries.AddRange(
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 1), QuantityMinutes = 30 },
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 2, 28), QuantityMinutes = 15 },
            new TimeEntry { TicketId = t1.Id, Date = new DateOnly(2026, 3, 1), QuantityMinutes = 60 }
        );
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetTotals(year: 2026, month: 2);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsType<List<TicketTotalDto>>(ok.Value);

        Assert.Single(list);
        Assert.Equal(45, list[0].Total);
    }

    [Fact]
    public async Task GetTotals_Should_Return_Zero_When_Ticket_Has_No_TimeEntries()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var t = new Ticket { Type = "GEN", ExternalKey = "", Label = "" };
        db.Tickets.Add(t);
        await db.SaveChangesAsync();

        var controller = new TicketsController(db);

        var result = await controller.GetTotals(year: null, month: null);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var list = Assert.IsType<List<TicketTotalDto>>(ok.Value);

        Assert.Single(list);
        Assert.Equal(0, list[0].Total);
    }
}
