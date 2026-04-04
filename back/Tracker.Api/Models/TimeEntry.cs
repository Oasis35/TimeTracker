namespace Tracker.Api.Models
{
    public class TimeEntry
    {
        public int Id { get; set; }
        public int? TicketId { get; set; }
        public Ticket? Ticket { get; set; }
        public DateOnly Date { get; set; }
        public int QuantityMinutes { get; set; }
        public bool IsSeed { get; set; }
    }
}
