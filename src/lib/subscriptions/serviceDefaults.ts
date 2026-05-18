import type { SubscriptionCadence } from "./pricing";

export interface ServiceDefault {
  /** Price in USD for `cadence` (defaults to monthly). */
  amount: number;
  cadence?: SubscriptionCadence;
}

/**
 * Curated USD ballpark prices. Amount is for `cadence` when set, otherwise monthly.
 * Weekly/yearly display amounts scale from this base via amountForCadence().
 */
export const SERVICE_DEFAULTS: Record<string, ServiceDefault> = {
  // Streaming and entertainment
  Netflix: { amount: 15.49 },
  Hulu: { amount: 17.99 },
  "Disney+": { amount: 13.99 },
  Max: { amount: 16.99 },
  "Amazon Prime Video": { amount: 8.99 },
  "Apple TV+": { amount: 9.99 },
  "Paramount+": { amount: 7.99 },
  Peacock: { amount: 7.99 },
  "YouTube Premium": { amount: 13.99 },
  Crunchyroll: { amount: 7.99 },
  "Discovery+": { amount: 4.99 },
  Starz: { amount: 10.99 },
  Showtime: { amount: 10.99 },
  BritBox: { amount: 8.99 },
  "ESPN+": { amount: 11.99 },

  // Music and audio
  Spotify: { amount: 11.99 },
  "Apple Music": { amount: 10.99 },
  "YouTube Music": { amount: 10.99 },
  "Amazon Music": { amount: 10.99 },
  Pandora: { amount: 4.99 },
  Tidal: { amount: 10.99 },
  Deezer: { amount: 11.99 },
  Audible: { amount: 14.95 },
  SiriusXM: { amount: 10.99 },
  "SoundCloud Go+": { amount: 4.99 },

  // Shopping and membership
  "Amazon Prime": { amount: 14.99 },
  "Walmart+": { amount: 12.95 },
  "Costco membership": { amount: 65, cadence: "yearly" },
  "Sam's Club membership": { amount: 50, cadence: "yearly" },
  "Target Circle 360": { amount: 99, cadence: "yearly" },
  "Best Buy Total": { amount: 179.99, cadence: "yearly" },
  "Instacart+": { amount: 9.99 },
  "DoorDash DashPass": { amount: 9.99 },
  "Uber One": { amount: 9.99 },
  Shipt: { amount: 10.99 },

  // Food and grocery (meal kits billed weekly)
  HelloFresh: { amount: 59.99, cadence: "weekly" },
  "Blue Apron": { amount: 47.95, cadence: "weekly" },
  "Home Chef": { amount: 49.95, cadence: "weekly" },
  EveryPlate: { amount: 39.99, cadence: "weekly" },
  "Green Chef": { amount: 71.99, cadence: "weekly" },
  Factor: { amount: 83.93, cadence: "weekly" },
  Hungryroot: { amount: 65, cadence: "weekly" },
  "FreshDirect DeliveryPass": { amount: 99, cadence: "yearly" },
  "Thrive Market": { amount: 59.95, cadence: "yearly" },
  "Misfits Market": { amount: 30, cadence: "weekly" },

  // Software and productivity
  "Microsoft 365": { amount: 9.99 },
  "Google Workspace": { amount: 12 },
  "Adobe Creative Cloud": { amount: 59.99 },
  Dropbox: { amount: 11.99 },
  OneDrive: { amount: 1.99 },
  "iCloud+": { amount: 2.99 },
  Notion: { amount: 10 },
  Evernote: { amount: 14.99 },
  Slack: { amount: 8.75 },
  Zoom: { amount: 15.99 },
  Canva: { amount: 15 },
  Grammarly: { amount: 12 },
  "ChatGPT Plus": { amount: 20 },
  "GitHub Copilot": { amount: 10 },
  Figma: { amount: 15 },
  Trello: { amount: 5 },
  "Monday.com": { amount: 12 },
  Asana: { amount: 13.49 },
  "Atlassian products": { amount: 7.75 },

  // Fitness and wellness
  Peloton: { amount: 44 },
  ClassPass: { amount: 49 },
  "Apple Fitness+": { amount: 9.99 },
  "Fitbit Premium": { amount: 9.99 },
  "Nike Run Club premium": { amount: 9.99 },
  Noom: { amount: 59 },
  BetterHelp: { amount: 65, cadence: "weekly" },
  Calm: { amount: 69.99, cadence: "yearly" },
  Headspace: { amount: 12.99 },
  "MyFitnessPal Premium": { amount: 19.99 },

  // Beauty and personal care
  Birchbox: { amount: 15 },
  Ipsy: { amount: 14 },
  FabFitFun: { amount: 59.99 },
  BoxyCharm: { amount: 28 },
  "Dollar Shave Club": { amount: 10 },
  "Harry's": { amount: 10 },
  Scentbird: { amount: 15.95 },
  "Function of Beauty": { amount: 19.99 },
  "Beauty Fix": { amount: 24 },
  "Grove Collaborative": { amount: 20 },

  // Gaming and tech
  "Xbox Game Pass": { amount: 16.99 },
  "PlayStation Plus": { amount: 17.99 },
  "Nintendo Switch Online": { amount: 3.99 },
  "EA Play": { amount: 5.99 },
  "Ubisoft+": { amount: 17.99 },
  "GeForce Now": { amount: 9.99 },
  "Xbox Cloud Gaming": { amount: 16.99 },
  "Discord Nitro": { amount: 9.99 },
  "NVIDIA GeForce subscriptions": { amount: 9.99 },

  // Learning and education
  MasterClass: { amount: 10 },
  Skillshare: { amount: 13.99 },
  "Coursera Plus": { amount: 59 },
  "Udemy subscriptions": { amount: 16.58 },
  "LinkedIn Premium": { amount: 29.99 },
  "Khan Academy": { amount: 0 },
  Brilliant: { amount: 24.99 },
  "Duolingo Super": { amount: 12.99 },

  // News, books, and reading
  "The New York Times": { amount: 17 },
  "The Washington Post": { amount: 10 },
  "Wall Street Journal": { amount: 38.99 },
  "The Athletic": { amount: 7.99 },
  "Medium Membership": { amount: 5 },
  "Kindle Unlimited": { amount: 11.99 },
  Scribd: { amount: 11.99 },
  Blinkist: { amount: 12.99 },
  "Pocket premium": { amount: 4.99 },

  // Home and household
  BarkBox: { amount: 35 },
  MeUndies: { amount: 22 },
  Quip: { amount: 25 },

  // Travel and transportation
  "TSA PreCheck": { amount: 78, cadence: "yearly" },
  "Global Entry": { amount: 100, cadence: "yearly" },
  "AAA Roadside Assistance": { amount: 65, cadence: "yearly" },
  "Hertz Gold Plus Rewards": { amount: 0, cadence: "yearly" },

  // Niche subscription boxes
  "Stitch Fix": { amount: 20 },
  "Loot Crate": { amount: 49.99 },
  "Cratejoy boxes": { amount: 39.99 },
  "Book of the Month": { amount: 16.99 },
  "Bespoke Post": { amount: 45 },
  Causebox: { amount: 54.95 },
  ButcherBox: { amount: 146, cadence: "monthly" },
  SnackCrate: { amount: 26 },
  "Trunk Club": { amount: 25 },
};

export function getServiceDefaults(
  serviceName: string,
): ServiceDefault | undefined {
  return SERVICE_DEFAULTS[serviceName];
}

export const SUBSCRIPTION_CADENCE_OPTIONS: {
  value: SubscriptionCadence;
  label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
