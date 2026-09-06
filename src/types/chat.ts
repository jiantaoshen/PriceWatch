export interface Advisor {
  id: string;
  name: string;
  title: string;
  description: string;
  greeting: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}