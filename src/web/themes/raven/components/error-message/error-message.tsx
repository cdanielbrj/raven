import "./error-message.css";

export function ErrorMessage({ message }: { message: string }) {
  return <p className="error-message">{message}</p>;
}
