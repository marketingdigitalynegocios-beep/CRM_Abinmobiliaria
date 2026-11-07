"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { inviteTeamMemberSchema, type InviteTeamMemberInput } from "@/lib/validations/team";

export function InviteTeamMemberForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteTeamMemberInput>({
    resolver: zodResolver(inviteTeamMemberSchema) as never,
    defaultValues: { role: "advisor" },
  });

  async function onSubmit(data: InviteTeamMemberInput) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        setError(body.error ?? "No se pudo invitar al asesor");
        return;
      }
      setSuccess(body.warning ?? "Invitación enviada — le llegó un enlace para ingresar.");
      reset({ role: "advisor" });
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {success && <p className="mb-3 text-sm text-success">{success}</p>}

      {!open ? (
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          onClick={() => setOpen(true)}
          type="button"
        >
          Invitar asesor
        </button>
      ) : (
        <form className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-white p-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray" htmlFor="fullName">
              Nombre
            </label>
            <input className="rounded-md border border-border px-3 py-2 text-sm" id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-xs text-danger">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray" htmlFor="email">
              Email
            </label>
            <input className="rounded-md border border-border px-3 py-2 text-sm" id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray" htmlFor="role">
              Rol
            </label>
            <select className="rounded-md border border-border px-3 py-2 text-sm" id="role" {...register("role")}>
              <option value="advisor">Asesor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Invitando..." : "Enviar invitación"}
          </button>
          <button className="rounded-md border border-border px-4 py-2 text-sm font-medium" onClick={() => setOpen(false)} type="button">
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
