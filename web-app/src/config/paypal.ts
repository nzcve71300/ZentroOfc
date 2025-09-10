// PayPal Configuration for Zentro Gaming
export const PAYPAL_CLIENT_ID = "AcyIfGaXFx9YGK1NLaoRnSf_opVxgHCKmXonfilvgATIZ-9eY1TruSuUVodfLouJzAd-etoLuXcFOTzG";

// Map "Server 1..10" to plan IDs. Replace/extend as needed.
export const PLAN_IDS = {
  server1: "P-8AR77395166841439NB5X35A",
  server2: "P-9YX55598TL658984RNB5X2QA", 
  server3: "P-5H962138SC373441NNB5X4PI",
  server4: "P-2GV923770A2824237NB5YACA",
  server5: "P-1LS75916T31810849NB5X5BQ",
  server10: "P-0U371623FC631544KNB5X5WA",
  // Servers 6-9 show "Coming soon" by default
};

export const SERVER_PLANS = [
  {
    id: "server1",
    name: "Server 1 - Starter",
    description: "Perfect for small communities",
    price: 9.99,
    features: ["Up to 50 players", "Basic plugins", "24/7 support"]
  },
  {
    id: "server2", 
    name: "Server 2 - Growth",
    description: "Ideal for growing communities",
    price: 19.99,
    features: ["Up to 100 players", "Advanced plugins", "Priority support"]
  },
  {
    id: "server3",
    name: "Server 3 - Pro",
    description: "For established communities",
    price: 29.99, 
    features: ["Up to 150 players", "All plugins", "Dedicated support"]
  },
  {
    id: "server4",
    name: "Server 4 - Elite",
    description: "High-performance gaming",
    price: 39.99,
    features: ["Up to 200 players", "Custom plugins", "24/7 phone support"]
  },
  {
    id: "server5",
    name: "Server 5 - Ultimate", 
    description: "Maximum performance",
    price: 49.99,
    features: ["Unlimited players", "Full customization", "Personal manager"]
  },
  {
    id: "server6",
    name: "Server 6 - Coming Soon",
    description: "Contact us for details",
    price: 0,
    features: ["Coming soon"],
    disabled: true
  },
  {
    id: "server7",
    name: "Server 7 - Coming Soon", 
    description: "Contact us for details",
    price: 0,
    features: ["Coming soon"],
    disabled: true
  },
  {
    id: "server8",
    name: "Server 8 - Coming Soon",
    description: "Contact us for details", 
    price: 0,
    features: ["Coming soon"],
    disabled: true
  },
  {
    id: "server9",
    name: "Server 9 - Coming Soon",
    description: "Contact us for details",
    price: 0,
    features: ["Coming soon"], 
    disabled: true
  },
  {
    id: "server10",
    name: "Server 10 - Enterprise",
    description: "Custom enterprise solution",
    price: 99.99,
    features: ["Fully managed", "Custom development", "Enterprise SLA"]
  }
];