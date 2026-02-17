namespace Tracker.Api.Models
{
    public class TimeEntry
    {
        public int Id { get; set; }
        public int TicketId { get; set; }
        public Ticket? Ticket { get; set; }

        public DateOnly Date { get; set; }

        public decimal Quantity { get; set; }

        public string? Comment { get; set; }
    }
}
