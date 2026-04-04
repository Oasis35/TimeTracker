using System.ComponentModel.DataAnnotations;

namespace Tracker.Api.Models;

public class AppSetting
{
    [Key]
    [MaxLength(64)]
    public string Key { get; set; } = "";

    [MaxLength(512)]
    public string Value { get; set; } = "";
}
