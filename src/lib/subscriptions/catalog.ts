export interface SubscriptionCategory {
  id: string;
  label: string;
  services: string[];
}

/** Curated subscription services grouped by category. */
export const SUBSCRIPTION_CATALOG: SubscriptionCategory[] = [
  {
    id: "streaming",
    label: "Streaming and entertainment",
    services: [
      "Netflix",
      "Hulu",
      "Disney+",
      "Max",
      "Amazon Prime Video",
      "Apple TV+",
      "Paramount+",
      "Peacock",
      "YouTube Premium",
      "Crunchyroll",
      "Discovery+",
      "Starz",
      "Showtime",
      "BritBox",
      "ESPN+",
    ],
  },
  {
    id: "music",
    label: "Music and audio",
    services: [
      "Spotify",
      "Apple Music",
      "YouTube Music",
      "Amazon Music",
      "Pandora",
      "Tidal",
      "Deezer",
      "Audible",
      "SiriusXM",
      "SoundCloud Go+",
    ],
  },
  {
    id: "shopping",
    label: "Shopping and membership",
    services: [
      "Amazon Prime",
      "Walmart+",
      "Costco membership",
      "Sam's Club membership",
      "Target Circle 360",
      "Best Buy Total",
      "Instacart+",
      "DoorDash DashPass",
      "Uber One",
      "Shipt",
    ],
  },
  {
    id: "food",
    label: "Food and grocery",
    services: [
      "HelloFresh",
      "Blue Apron",
      "Home Chef",
      "EveryPlate",
      "Green Chef",
      "Factor",
      "Hungryroot",
      "FreshDirect DeliveryPass",
      "Thrive Market",
      "Misfits Market",
    ],
  },
  {
    id: "software",
    label: "Software and productivity",
    services: [
      "Microsoft 365",
      "Google Workspace",
      "Adobe Creative Cloud",
      "Dropbox",
      "OneDrive",
      "iCloud+",
      "Notion",
      "Evernote",
      "Slack",
      "Zoom",
      "Canva",
      "Grammarly",
      "ChatGPT Plus",
      "GitHub Copilot",
      "Figma",
      "Trello",
      "Monday.com",
      "Asana",
      "Atlassian products",
    ],
  },
  {
    id: "fitness",
    label: "Fitness and wellness",
    services: [
      "Peloton",
      "ClassPass",
      "Apple Fitness+",
      "Fitbit Premium",
      "Nike Run Club premium",
      "Noom",
      "BetterHelp",
      "Calm",
      "Headspace",
      "MyFitnessPal Premium",
    ],
  },
  {
    id: "beauty",
    label: "Beauty and personal care",
    services: [
      "Birchbox",
      "Ipsy",
      "FabFitFun",
      "BoxyCharm",
      "Dollar Shave Club",
      "Harry's",
      "Scentbird",
      "Function of Beauty",
      "Beauty Fix",
      "Grove Collaborative",
    ],
  },
  {
    id: "gaming",
    label: "Gaming and tech",
    services: [
      "Xbox Game Pass",
      "PlayStation Plus",
      "Nintendo Switch Online",
      "EA Play",
      "Ubisoft+",
      "GeForce Now",
      "Xbox Cloud Gaming",
      "Discord Nitro",
      "NVIDIA GeForce subscriptions",
    ],
  },
  {
    id: "learning",
    label: "Learning and education",
    services: [
      "MasterClass",
      "Skillshare",
      "Coursera Plus",
      "Udemy subscriptions",
      "LinkedIn Premium",
      "Khan Academy",
      "Brilliant",
      "Duolingo Super",
    ],
  },
  {
    id: "news",
    label: "News, books, and reading",
    services: [
      "The New York Times",
      "The Washington Post",
      "Wall Street Journal",
      "The Athletic",
      "Medium Membership",
      "Kindle Unlimited",
      "Scribd",
      "Blinkist",
      "Pocket premium",
    ],
  },
  {
    id: "home",
    label: "Home and household",
    services: ["BarkBox", "MeUndies", "Quip"],
  },
  {
    id: "travel",
    label: "Travel and transportation",
    services: [
      "TSA PreCheck",
      "Global Entry",
      "AAA Roadside Assistance",
      "Hertz Gold Plus Rewards",
    ],
  },
  {
    id: "boxes",
    label: "Niche subscription boxes",
    services: [
      "Stitch Fix",
      "Loot Crate",
      "Cratejoy boxes",
      "Book of the Month",
      "Bespoke Post",
      "Causebox",
      "ButcherBox",
      "SnackCrate",
      "Trunk Club",
    ],
  },
];

export const CUSTOM_CATEGORY_ID = "custom";

export function getCategoryById(id: string): SubscriptionCategory | undefined {
  return SUBSCRIPTION_CATALOG.find((c) => c.id === id);
}

export type { SubscriptionCadence } from "./pricing";
export type { ServiceDefault } from "./serviceDefaults";
export {
  SERVICE_DEFAULTS,
  getServiceDefaults,
  SUBSCRIPTION_CADENCE_OPTIONS,
} from "./serviceDefaults";
export { amountForCadence, formatSubscriptionAmount } from "./pricing";
