import 'dotenv/config';
import { db } from '../src/lib/db';
import { users } from '../src/db/schema';

(async () => {
  const list = await db
    .select({
      id: users.id,
      clerkId: users.clerkId,
      email: users.email,
      name: users.name,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users);
  console.log(JSON.stringify(list, null, 2));
  process.exit(0);
})();
