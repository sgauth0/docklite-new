declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      exec: (...args: any[]) => any;
      prepare: (...args: any[]) => any;
      transaction: (...args: any[]) => any;
    }
  }
  const Database: any;
  export default Database;
}

declare module 'bcrypt';

declare module 'dockerode' {
  namespace Docker {
    interface ContainerCreateOptions {}
    interface Port {}
  }
  const Docker: any;
  export default Docker;
}
