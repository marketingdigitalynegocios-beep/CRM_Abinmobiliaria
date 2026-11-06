import { PropertyOwnerForm } from "@/components/properties/PropertyOwnerForm";

export default function NewPropertyOwnerPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Nuevo propietario</h1>
      <div className="mt-6">
        <PropertyOwnerForm />
      </div>
    </div>
  );
}
