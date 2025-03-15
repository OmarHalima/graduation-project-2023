import { User } from '../types/auth';

interface UserDetailsProps {
  user: User;
}

export function UserDetails({ user }: UserDetailsProps) {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium">{user.full_name}</h3>
      <p className="text-gray-500">{user.email}</p>
      <p className="text-gray-500 capitalize">Role: {user.role}</p>
      <p className="text-gray-500 capitalize">Status: {user.status}</p>
    </div>
  );
}
