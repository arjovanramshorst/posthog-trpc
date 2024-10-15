const hasProperty = <Key extends string>(
  obj: unknown,
  key: Key
): obj is Record<Key, unknown> => {
  return !!obj && typeof obj === 'object' && key in obj!;
};

export const deepGet = <T>(obj: unknown, path: string, defaultValue?: T) => {
  try {
    return path
      .split('.')
      .reduce(
        (finger, key) =>
          hasProperty(finger, key) ? finger[key] : defaultValue,
        obj
      );
  } catch (e) {
    console.error(e);
    return defaultValue;
  }
};

export function associateBy<T, K = T>(
  list: T[],
  selector: (t: T) => string,
  mapFn: (t: T) => K = (it) => it as unknown as K
): Record<string, K> {
  const res: Record<string, K> = {};
  list.forEach((it) => {
    res[selector(it)] = mapFn(it);
  });
  return res;
}

export function toMap<T>(list: { key: string; value: T }[]) {
  return associateBy(
    list,
    (it) => it.key,
    (it) => it.value
  );
}

type OptionalKeys<T> = {
  // -? removes optionality: https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#mapping-modifiers
  [K in keyof T]-?: object extends { [P in K]: T[K] } ? K : never;
}[keyof T];

export type OptionalProps<T> = Pick<T, OptionalKeys<T>>;
