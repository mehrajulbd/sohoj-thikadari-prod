import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

test('Supabase migration: authorization, billing, financial ledgers and idempotency', async (t) => {
  const db = new PGlite();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  await db.exec(await readFile('supabase/migrations/202611190001_workspace.sql', 'utf8'));
  const owner = randomUUID(),
    other = randomUUID(),
    staffUser = randomUUID();
  for (const [id, email] of [
    [owner, 'owner@test.local'],
    [other, 'other@test.local'],
    [staffUser, 'staff@test.local'],
  ])
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, email]);
  const actor = async (id: string) => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const workspace = async (id: string) => {
    await actor(id);
    return (await db.query<{ get_workspace: { org_id: string } }>('select get_workspace()')).rows[0]
      .get_workspace;
  };
  const a = await workspace(owner),
    b = await workspace(other);
  await actor(owner);
  const apply = async (
    kind: string,
    id: string,
    data: unknown,
    version = 0,
    reason = '',
    op = randomUUID(),
  ) =>
    (
      await db.query<{ apply_operation: any }>('select apply_operation($1,$2,$3,$4,$5,$6)', [
        op,
        kind,
        id,
        JSON.stringify(data),
        version,
        reason,
      ])
    ).rows[0].apply_operation;
  const firm = randomUUID(),
    staff = randomUUID(),
    head = randomUUID(),
    program = randomUUID(),
    dispatch = randomUUID(),
    bill = randomUUID();
  await apply('firms', firm, { name: 'Test firm', active: true });
  await apply('staff', staff, {
    name: 'Staff',
    phone: '01700000001',
    email: 'staff@test.local',
    active: true,
  });
  await apply('expense_heads', head, { name: 'Truck hire', active: true });
  const programData = {
    firm_id: firm,
    number: '001/2026',
    date: '2026-11-19',
    commodity: 'Rice',
    sending: 'A',
    receiving: 'B',
    quantity: 30,
  };
  await apply('programs', program, programData);
  const dispatchData = {
    program_id: program,
    invoice_no: '0001',
    truck_no: 'Truck 1',
    sending_date: '2026-11-19',
    sending_bags: 300,
    sending_net: 14.5,
    sending_gross: 15.5,
    receiving_date: '2026-11-20',
    receiving_bags: 299,
    receiving_gross_bags: 298,
    receiving_net: 14.2,
    receiving_gross: 15.2,
    shortage: 0,
  };
  await apply('dispatches', dispatch, dispatchData);
  await t.test('distinct receipt values survive and valid zero shortage is retained', async () => {
    const r = (await db.query<{ data: any }>('select data from dispatches where id=$1', [dispatch]))
      .rows[0].data;
    assert.equal(r.receiving_bags, 299);
    assert.equal(r.receiving_gross_bags, 298);
    assert.equal(r.receiving_net, 14.2);
    assert.equal(r.receiving_gross, 15.2);
    assert.equal(r.shortage, 0);
  });
  await t.test('advance is not an expense, and retries do not duplicate it', async () => {
    const id = randomUUID(),
      op = randomUUID();
    const data = {
      staff_id: staff,
      type: 'give',
      amount: 100000,
      date: '2026-11-19',
      reason: 'Advance',
    };
    await apply('money_movements', id, data, 0, '', op);
    await apply('money_movements', id, data, 0, '', op);
    const count = await db.query<{ n: number }>('select count(*)::int n from money_movements');
    assert.equal(count.rows[0].n, 1);
  });
  const expense = randomUUID();
  await apply('expenses', expense, {
    scope: 'program',
    program_id: program,
    staff_id: staff,
    head_id: head,
    date: '2026-11-19',
    amount: 90000,
    reason: 'Truck hire',
  });
  await db.query(
    "insert into memberships(user_id,org_id,role,staff_id,name,email) values($1,$2,'staff',$3,'Staff','staff@test.local')",
    [staffUser, a.org_id, staff],
  );
  await t.test(
    'staff may enter operations and own expenses, but cannot create programs or bills',
    async () => {
      await actor(staffUser);
      await assert.rejects(() => apply('programs', randomUUID(), programData), /owner/);
      await assert.rejects(() => apply('bills', bill, {}), /owner/);
      await assert.rejects(
        () =>
          apply('expenses', randomUUID(), {
            scope: 'organization',
            staff_id: '',
            head_id: head,
            date: '2026-11-19',
            amount: 2,
            reason: 'Self expense',
          }),
        /own expenses/,
      );
      await actor(owner);
    },
  );
  await t.test('cross organization references and reads are rejected', async () => {
    await actor(other);
    await assert.rejects(() => apply('programs', randomUUID(), programData), /organization/);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from expenses')).rows.length, 0);
    await db.exec('reset role');
    await actor(owner);
  });
  await t.test('bill total uses received gross weight and prevents repeat billing', async () => {
    await apply('bills', bill, {
      firm_id: firm,
      number: 'B-1',
      date: '2026-11-20',
      recipient: 'CMS',
      status: 'finalized',
      program_ids: [program],
      rates: [{ program_id: program, rate: 10000 }],
    });
    const r = (await db.query<{ data: any }>('select data from bills where id=$1', [bill])).rows[0]
      .data;
    assert.equal(r.total, 152000);
    await assert.rejects(
      () =>
        apply('bills', randomUUID(), {
          firm_id: firm,
          number: 'B-2',
          date: '2026-11-20',
          recipient: 'CMS',
          status: 'finalized',
          program_ids: [program],
          rates: [{ program_id: program, rate: 10000 }],
        }),
      /already billed/,
    );
  });
  await t.test('staff RLS hides owner finances and another organization records', async () => {
    await actor(staffUser);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from bills')).rows.length, 0);
    assert.equal((await db.query('select * from expenses')).rows.length, 1);
    assert.equal((await db.query('select * from organizations')).rows.length, 1);
    await assert.rejects(() => db.query("update expenses set data='{}'"), /permission|policy/);
    await db.exec('reset role');
    await actor(owner);
  });
  const settlement = randomUUID();
  await t.test('tax applies after adjustments and closes the program', async () => {
    await apply('settlements', settlement, {
      bill_id: bill,
      date: '2026-11-21',
      amount: 151900,
      tax_mode: 'percent',
      tax_value: 2,
      adjustments: [
        {
          program_id: program,
          extra: 5000,
          shortage: 2000,
          deduction: 0,
          reason: 'Fuel less shortage',
        },
      ],
    });
    const r = (
      await db.query<{ data: any }>('select data from settlements where id=$1', [settlement])
    ).rows[0].data;
    assert.equal(r.tax, 3100);
    assert.equal(r.amount, 151900);
    assert.equal(r.allocations[0].net, 151900);
    assert.equal(
      (await db.query<{ data: any }>('select data from programs where id=$1', [program])).rows[0]
        .data.closed,
      true,
    );
  });
  await t.test(
    'closed program refuses staff expenses; owner late costs and supplementary receipts work',
    async () => {
      await actor(staffUser);
      await assert.rejects(
        () =>
          apply('expenses', randomUUID(), {
            scope: 'program',
            program_id: program,
            staff_id: staff,
            head_id: head,
            date: '2026-11-22',
            amount: 50,
            reason: 'Late expense',
          }),
        /closed/,
      );
      await actor(owner);
      await apply('expenses', randomUUID(), {
        scope: 'program',
        program_id: program,
        staff_id: staff,
        head_id: head,
        date: '2026-11-22',
        amount: 50,
        reason: 'Late expense',
      });
      await apply('supplementary_receipts', randomUUID(), {
        program_id: program,
        date: '2026-12-01',
        amount: 4000,
        reason: 'Later fuel allowance',
        tax_amount: 0,
      });
    },
  );
  await t.test('edits require reasons and stale versions fail', async () => {
    await assert.rejects(() => apply('programs', program, programData, 1, ''), /changed|reason/);
    await assert.rejects(() => apply('programs', program, programData, 0, 'Correction'), /changed/);
    assert.ok((await db.query('select * from audit_events')).rows.length > 8);
  });
  await t.test('rounding across many tiny programs allocates positive cents exactly', async () => {
    const items = Array.from({ length: 100 }, () => ({ program_id: randomUUID(), weight: 0.01 }));
    const r = (
      await db.query<{ allocate_money: { amount: number }[] }>('select allocate_money($1,$2)', [
        JSON.stringify(items),
        0.5,
      ])
    ).rows[0].allocate_money;
    assert.equal(Math.round(r.reduce((s, x) => s + Number(x.amount), 0) * 100), 50);
    assert.ok(r.every((x) => Number(x.amount) >= 0));
  });
  await t.test('staff cannot claim owner self-expenses by guessing their IDs', async () => {
    const id = randomUUID();
    const data = {
      scope: 'organization',
      head_id: head,
      staff_id: '',
      date: '2026-11-21',
      amount: 200,
      reason: 'Owner office expense',
    };
    await apply('expenses', id, data);
    await actor(staffUser);
    await assert.rejects(
      () => apply('expenses', id, { ...data, staff_id: staff }, 1, 'Claim expense'),
      /own expenses/,
    );
    await actor(owner);
  });
  await t.test('negative opening balances, paired transfers, and tracked reversals', async () => {
    const second = randomUUID();
    await apply('staff', second, { name: 'Second staff', active: true });
    await apply('money_movements', randomUUID(), {
      type: 'opening',
      staff_id: second,
      amount: -500,
      date: '2026-11-01',
      reason: 'Opening amount owed',
    });
    const transfer = randomUUID();
    await apply('money_movements', transfer, {
      type: 'transfer',
      staff_id: staff,
      to_staff_id: second,
      amount: 3000,
      date: '2026-11-22',
      reason: 'Working cash transfer',
    });
    await db.query('select reverse_money($1,$2,$3)', [transfer, 'Wrong recipient', '2026-11-23']);
    await assert.rejects(
      () => db.query('select reverse_money($1,$2,$3)', [transfer, 'Second attempt', '2026-11-23']),
      /already/,
    );
    const r = (
      await db.query<{ data: any }>('select data from money_movements where reverses_id=$1', [
        transfer,
      ])
    ).rows[0].data;
    assert.equal(r.staff_id, second);
    assert.equal(r.to_staff_id, staff);
    assert.equal(r.amount, 3000);
  });
  await t.test(
    'receipt corrections retain audit history and recalculate adjusted tax',
    async () => {
      const old = (
        await db.query<{ version: number }>('select version from settlements where id=$1', [
          settlement,
        ])
      ).rows[0];
      await apply(
        'settlements',
        settlement,
        {
          bill_id: bill,
          date: '2026-11-21',
          amount: 148960,
          tax_mode: 'percent',
          tax_value: 2,
          adjustments: [],
        },
        old.version,
        'Remove mistaken allowance',
      );
      const r = (
        await db.query<{ data: any }>('select data from settlements where id=$1', [settlement])
      ).rows[0].data;
      assert.equal(r.tax, 3040);
      assert.equal(r.amount, 148960);
      const audit = (await db.query('select * from audit_events where record_id=$1', [settlement]))
        .rows;
      assert.equal(audit.length, 2);
    },
  );
  await t.test(
    'unpaid bill cancellation releases whole program while paid bills remain protected',
    async () => {
      await assert.rejects(
        () => db.query('select cancel_bill($1,$2)', [bill, 'Cancel paid bill']),
        /Paid bills/,
      );
      const p = randomUUID(),
        inv = randomUUID(),
        b = randomUUID();
      await apply('programs', p, { ...programData, number: 'CANCEL-TEST' });
      await apply('dispatches', inv, { ...dispatchData, program_id: p });
      await apply('bills', b, {
        firm_id: firm,
        number: 'B-CANCEL',
        date: '2026-11-20',
        recipient: 'CMS',
        status: 'finalized',
        program_ids: [p],
        rates: [{ program_id: p, rate: 100 }],
      });
      await db.query('select cancel_bill($1,$2)', [b, 'Wrong bill header']);
      assert.equal(
        (await db.query('select * from bill_allocations where program_id=$1', [p])).rows.length,
        0,
      );
    },
  );
  await t.test('organization financial-year setting is owner-controlled', async () => {
    await db.query('select set_fiscal_month(1)');
    const ws = (
      await db.query<{ get_workspace: { fiscal_month: number } }>('select get_workspace()')
    ).rows[0].get_workspace;
    assert.equal(ws.fiscal_month, 1);
    await actor(staffUser);
    await assert.rejects(() => db.query('select set_fiscal_month(7)'), /Owner/);
    await actor(owner);
  });
  await t.test(
    'malformed financial requests fail even when browser validation is bypassed',
    async () => {
      await assert.rejects(
        () =>
          apply('money_movements', randomUUID(), {
            staff_id: staff,
            amount: 200,
            date: '2026-11-19',
            reason: 'Missing type',
          }),
        /movement/,
      );
      await assert.rejects(
        () =>
          apply('expenses', randomUUID(), {
            scope: 'organization',
            head_id: head,
            amount: 'NaN',
            date: '2026-11-19',
            reason: 'Bad amount',
          }),
        /numeric/,
      );
      await assert.rejects(
        () =>
          apply('settlements', randomUUID(), {
            bill_id: bill,
            tax_mode: 'percent',
            date: '2026-11-19',
            amount: 100,
          }),
        /tax.*amounts/,
      );
    },
  );
  await db.close();
});
