import type { GroupingMembershipInput } from "@ecom/contracts";

export const groupingQuerySet =
  <Id extends string, Input>(
    validateCatalogItemIds: (input: GroupingMembershipInput["catalogItemIds"]) => Promise<boolean>,
  ) =>
  <Row extends { id: string }, Dto>(config: {
    rows: (id: Id) => PromiseLike<Row[]>;
    membershipRows: (id: Id) => PromiseLike<{ id: string }[]>;
    identityRows: (identity: string, excludedId?: Id) => PromiseLike<unknown[]>;
    identity: (input: Input) => string;
    duplicateKind: "duplicate_slug" | "duplicate_label";
    createId: () => Id;
    insert: (id: Id, input: Input, now: Date) => Promise<unknown>;
    dto: (row: Row, catalogItemIds: string[]) => Dto;
    replace: (id: Id, input: GroupingMembershipInput) => Promise<unknown>;
  }) => {
    const catalogItemIds = async (id: Id) =>
      (await config.membershipRows(id)).map(({ id: catalogItemId }) => catalogItemId);
    const find = async (id: Id) => {
      const [row] = await config.rows(id);
      return row ? config.dto(row, await catalogItemIds(id)) : undefined;
    };
    const identityExists = async (identity: string, excludedId?: Id) =>
      (await config.identityRows(identity, excludedId)).length > 0;
    return {
      find,
      catalogItemIds,
      identityExists,
      async create(input: Input) {
        const identity = config.identity(input);
        if (await identityExists(identity)) {
          return { kind: config.duplicateKind } as const;
        }
        const id = config.createId();
        try {
          await config.insert(id, input, new Date());
          return { kind: "changed" as const, value: await find(id) };
        } catch {
          return (await identityExists(identity))
            ? ({ kind: config.duplicateKind } as const)
            : ({ kind: "infrastructure" } as const);
        }
      },
      async replaceMembership(id: Id, input: GroupingMembershipInput) {
        if (!(await find(id))) {
          return { kind: "not_found" as const };
        }
        if (!(await validateCatalogItemIds(input.catalogItemIds))) {
          return { kind: "catalog_item_not_found" as const };
        }
        await config.replace(id, input);
        return { kind: "changed" as const, value: await find(id) };
      },
    };
  };
