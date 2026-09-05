export type Character = {
  id: string;
  name: string;
  age: number;
  occupation: string;
  greeting: string;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
};