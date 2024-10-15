import { buildTestContext, TestContext } from './test.env';
import { z } from 'zod';
import { ph } from '../src';

const captureMock = jest.fn();
const posthog = {
  capture: captureMock,
};

const defaultConfig = {
  client: posthog,
  getDistinctId: (ctx: TestContext) => ctx.username,
};

describe('Parsing the meta data', () => {
  beforeEach(() => {
    posthog.capture.mockClear();
  });
  describe('handling config', () => {
    it('should get correct distinct id and context', async () => {
      const { router, procedure, build } = buildTestContext({
        ...defaultConfig,
        getPropsFromContext: (ctx) => ({ username: ctx.username }),
      });
      const api = build(
        router({
          test: procedure.mutation(async () => {}),
        })
      );
      await api({ username: 'arjo' }).test();
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'mutate:test',
        distinctId: 'arjo',
        properties: {
          username: 'arjo',
        },
      });
    });
    it('should ignore query endpoints by default', async () => {
      const { router, procedure, build } = buildTestContext(defaultConfig);
      const api = build(
        router({
          test: procedure.query(async () => {}),
        })
      );
      await api({ username: 'arjo' }).test();
      expect(posthog.capture).not.toHaveBeenCalled();
    });
    it('should include query endpoints when configured', async () => {
      const { router, procedure, build } = buildTestContext({
        ...defaultConfig,
        includeQueries: true,
      });
      const api = build(
        router({
          test: procedure.query(async () => {}),
        })
      );
      await api({ username: 'arjo' }).test();
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'query:test',
        distinctId: 'arjo',
        properties: {},
      });
    });
  });
  describe('using metadata', () => {
    it('should include properties defined in ph.capture()', async () => {
      const { router, procedure, build } = buildTestContext(defaultConfig);
      const api = build(
        router({
          hello: procedure
            .input(z.object({ name: z.string(), age: z.number().optional() }))
            .meta(
              ph.capture([ph.string('name'), ph.isSet('age', 'includeAge')])
            )
            .mutation(async () => {}),
        })
      );
      await api({ username: 'arjo' }).hello({
        name: 'world',
      });
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'mutate:hello',
        distinctId: 'arjo',
        properties: {
          name: 'world',
          includeAge: false,
        },
      });

      await api({ username: 'arjo' }).hello({
        name: 'world',
        age: 30,
      });
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'mutate:hello',
        distinctId: 'arjo',
        properties: {
          name: 'world',
          includeAge: true,
        },
      });
    });
    it('should correctly handle falsy values for isSet', async () => {
      const { router, procedure, build } = buildTestContext(defaultConfig);
      const api = build(
        router({
          test: procedure
            .input(
              z.object({
                name: z.string().optional(),
                age: z.number().optional(),
                isAdmin: z.boolean().optional(),
              })
            )
            .meta(
              ph.capture([
                ph.isSet('name'),
                ph.isSet('age'),
                ph.isSet('isAdmin'),
              ])
            )
            .mutation(async () => {}),
        })
      );
      await api({ username: 'arjo' }).test({
        name: '',
        age: 0,
        isAdmin: false,
      });
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'mutate:test',
        distinctId: 'arjo',
        properties: {
          name: true,
          age: true,
          isAdmin: true,
        },
      });
      await api({ username: 'arjo' }).test({});
      expect(posthog.capture).toHaveBeenCalledWith({
        event: 'mutate:test',
        distinctId: 'arjo',
        properties: {
          name: false,
          age: false,
          isAdmin: false,
        },
      });
    });
    it('should skip routes using ph.skip()', async () => {
      const { router, procedure, build } = buildTestContext(defaultConfig);
      const api = build(
        router({
          test: procedure.meta(ph.skip()).mutation(async () => {}),
        })
      );
      await api({ username: 'arjo' }).test();
      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });
});
