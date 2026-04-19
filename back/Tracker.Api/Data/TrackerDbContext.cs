using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Globalization;
using Tracker.Api.Models;

namespace Tracker.Api.Data
{
    public class TrackerDbContext : DbContext
    {
        public TrackerDbContext(DbContextOptions<TrackerDbContext> options) : base(options) { }

        public DbSet<Ticket> Tickets => Set<Ticket>();
        public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
        public DbSet<AppSetting> AppSettings => Set<AppSetting>();

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder
                .Properties<DateOnly>()
                .HaveConversion<DateOnlyToStringConverter>()
                .HaveMaxLength(10);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Ticket>()
                .Property(t => t.Type)
                .HasConversion<string>()
                .HasMaxLength(32)
                .IsRequired();

            modelBuilder.Entity<Ticket>()
                .Property(t => t.ExternalKey)
                .HasMaxLength(64);

            modelBuilder.Entity<Ticket>()
                .Property(t => t.Label)
                .HasMaxLength(200);

            modelBuilder.Entity<Ticket>()
                .HasIndex(t => new { t.Type, t.ExternalKey })
                .IsUnique();

            modelBuilder.Entity<TimeEntry>()
                .Property(x => x.QuantityMinutes)
                .HasColumnType("INTEGER");

            var dateOnlyConverter = new ValueConverter<DateOnly, string>(
                d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                s => DateOnly.ParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture));

            modelBuilder.Entity<TimeEntry>()
                .Property(x => x.Date)
                .HasConversion(dateOnlyConverter)
                .HasMaxLength(10)
                .IsRequired();

            modelBuilder.Entity<TimeEntry>()
                .HasIndex(x => new { x.TicketId, x.Date })
                .IsUnique();

            modelBuilder.Entity<TimeEntry>()
                .HasIndex(x => x.Date);

            modelBuilder.Entity<AppSetting>()
                .HasKey(s => s.Key);

            modelBuilder.Entity<AppSetting>()
                .Property(s => s.Key)
                .HasMaxLength(64)
                .IsRequired()
                .ValueGeneratedNever();

            modelBuilder.Entity<AppSetting>()
                .Property(s => s.Value)
                .HasMaxLength(512)
                .IsRequired();

            base.OnModelCreating(modelBuilder);
        }
    }
}
