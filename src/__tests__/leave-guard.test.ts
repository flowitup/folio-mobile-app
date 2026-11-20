import { interceptLeave, setLeaveGuard } from "@/lib/navigation/leave-guard";

describe("leave guard", () => {
  it("lets navigation through when no screen holds it", () => {
    expect(interceptLeave(jest.fn())).toBe(false);
  });

  it("hands the leave to the active guard, and stops once removed", () => {
    const proceed = jest.fn();
    const guard = jest.fn(() => true);
    const remove = setLeaveGuard(guard);
    expect(interceptLeave(proceed)).toBe(true);
    expect(guard).toHaveBeenCalledWith(proceed);
    remove();
    expect(interceptLeave(proceed)).toBe(false);
  });

  it("removing an older guard keeps the newer one", () => {
    const removeOld = setLeaveGuard(() => true);
    const removeNew = setLeaveGuard(() => true);
    removeOld();
    expect(interceptLeave(jest.fn())).toBe(true);
    removeNew();
  });
});
