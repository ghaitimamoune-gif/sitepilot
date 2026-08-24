import { LoginForm } from '@/components/admin/LoginForm'

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="mb-1 text-display-l">Connexion</h1>
      <p className="mb-6 text-body-s text-eb-grey">
        Réservé au personnel Easy Burger.
      </p>
      <LoginForm />
    </div>
  )
}
