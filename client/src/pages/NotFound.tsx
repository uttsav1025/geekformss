import { Link } from 'react-router-dom';

export default function NotFound({ title = 'Page not found', message = "That page doesn't exist." }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-100 p-6 text-center">
        <h1>{title}</h1>
        <p className="text-muted">{message}</p>
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
      </div>
    </div>
  );
}
