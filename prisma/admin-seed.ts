export function assertAdminSeedable(email: string, existingRole: string | null) {
  if (existingRole === null || existingRole === "ADMIN") return;
  throw new Error(
    `ADMIN_EMAIL (${email}) sudah dipakai akun ber-role ${existingRole}. Pakai email lain untuk admin atau ubah role akun itu secara manual.`,
  );
}
