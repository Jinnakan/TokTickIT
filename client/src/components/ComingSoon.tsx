export function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="alert alert-secondary" role="status">
      <strong>{feature}</strong> is not built yet — coming in a later Lab 3 issue.
    </div>
  )
}
