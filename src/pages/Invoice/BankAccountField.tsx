import { FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { BankAccount, bankAccountLabel } from "./bankShared";

/**
 * Where the money went in or came out (accounts from useBankAccounts). Forms preset it with defaultBankAccountId
 * when they open and when the method changes; left empty, the service uses the company's default for the method.
 * Hidden when no accounts are set up, and then the service posts to the Cash or Bank account as before.
 */
const BankAccountField = ({
  accounts,
  label,
  value,
  onChange,
}: {
  accounts: BankAccount[] | null;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (!accounts || accounts.length === 0) return null;
  const options = accounts
    .filter((a) => a.active || String(a.id) === value)
    .map((a) => ({ id: String(a.id), name: `${bankAccountLabel(a)}${a.kind === "CASH" ? " (cash)" : ""}` }));
  return (
    <FloatingSelect1
      label={label}
      name="bankAccountId"
      value={value}
      options={options}
      emptyOptionLabel="Default for the method"
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export default BankAccountField;
