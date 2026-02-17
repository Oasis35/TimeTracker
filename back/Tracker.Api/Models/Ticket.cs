namespace Tracker.Api.Models
{
    public class Ticket
    {
        public int Id { get; set; }
        public string Type { get; set; } = "";
        public string? ExternalKey { get; set; }
        public string? Label { get; set; }
    }
}
