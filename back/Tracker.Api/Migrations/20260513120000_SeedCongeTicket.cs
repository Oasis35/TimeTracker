using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedCongeTicket : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO Tickets (Type, ExternalKey, Label)
                SELECT 'ABSENT', 'CP', 'Congé'
                WHERE NOT EXISTS (SELECT 1 FROM Tickets WHERE Type = 'ABSENT' AND ExternalKey = 'CP');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM Tickets WHERE Type = 'ABSENT' AND ExternalKey = 'CP';
                """);
        }
    }
}
