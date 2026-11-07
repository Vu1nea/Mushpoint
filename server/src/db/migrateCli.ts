import { migrate } from './migrate';

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error('MIGRATE_DATABASE_URL is required');
  process.exit(1);
}
migrate(url, process.env.MUSHPOINT_APP_PASSWORD).then(
  () => console.log('migrations applied'),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
