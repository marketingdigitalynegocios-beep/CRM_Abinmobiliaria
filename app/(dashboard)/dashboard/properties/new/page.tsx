import { PropertyForm } from "@/components/properties/PropertyForm";

export default function NewPropertyPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Nueva propiedad</h1>
      <div className="mt-6">
        <PropertyForm />
      </div>
    </div>
  );
}
