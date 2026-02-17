using Microsoft.EntityFrameworkCore;
using Tracker.Api.Models;

namespace Tracker.Api.Data
{
    public class TrackerDbContext : DbContext
    {
        public TrackerDbContext(DbContextOptions<TrackerDbContext> options) : base(options) { }

        public DbSet<Ticket> Tickets => Set<Ticket>();
        public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<TimeEntry>()
                .Property(x => x.Quantity)
                .HasPrecision(5, 2);

            modelBuilder.Entity<TimeEntry>()
                .HasIndex(x => new { x.Date, x.TicketId });

            base.OnModelCreating(modelBuilder);
        }
    }
}
