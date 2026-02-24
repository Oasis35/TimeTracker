using Microsoft.AspNetCore.Mvc;
using Tracker.Api.Controllers;
using Tracker.Api.Dtos.Tickets;
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

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Type obligatoire.", bad.Value);
    }

    [Fact]
    public async Task Create_Should_Return_BadRequest_When_ExternalKey_Provided_But_Label_Missing()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var result = await controller.Create(new CreateTicketDto(Type: "JIRA", ExternalKey: "ABC-1", Label: "   "));

        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Label obligatoire si ExternalKey est renseignée.", bad.Value);
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
    // GET /api/tickets/totals
    // -------------------------

    [Fact]
    public async Task GetTotals_Should_Return_BadRequest_When_Only_Year_Or_Only_Month()
    {
        var (db, conn) = DbTestHelper.CreateSqliteInMemoryDb();
        await using var _ = db;
        await using var __ = conn;

        var controller = new TicketsController(db);

        var r1 = await controller.GetTotals(year: 2026, month: null);
        Assert.IsType<BadRequestObjectResult>(r1.Result);

        var r2 = await controller.GetTotals(year: null, month: 2);
        Assert.IsType<BadRequestObjectResult>(r2.Result);
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
        var bad = Assert.IsType<BadRequestObjectResult>(r.Result);
        Assert.Equal("month invalide.", bad.Value);
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
        Assert.Equal(60m, list[0].Total);

        Assert.Equal(t1.Id, list[1].TicketId);
        Assert.Equal(45m, list[1].Total);
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
        Assert.Equal(45m, list[0].Total);
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
        Assert.Equal(0m, list[0].Total);
    }
}
