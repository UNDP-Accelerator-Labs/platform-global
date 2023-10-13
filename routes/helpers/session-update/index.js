const updateSession = async _kwarq =>{
    const { whereClause, queryValues, conn } = _kwarq
      await conn.none(`
        UPDATE session 
        SET sess = jsonb_build_object(
          'cookie', sess -> 'cookie',
          'sessions', sess -> 'sessions',
          'uuid', null,
          'username', null,
          'email', null,
          'team', sess -> 'team',
          'collaborators', sess -> 'collaborators',
          'rights', sess -> 'rights',
          'public', sess -> 'public',
          'language', sess -> 'language',
          'country', sess -> 'country',
          'app', sess -> 'app',
          'device', sess -> 'device',
          'is_trusted', sess -> 'is_trusted',
          'confirm_dev_origins', sess -> 'confirm_dev_origins'
        )
        WHERE ${whereClause};
      `, queryValues)
      .catch(err => console.log(err));
  }

  module.exports = updateSession;