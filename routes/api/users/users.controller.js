'use strict';

const usersService = require('./users.service');
const { CrudController } = require('@shared/layers/crud.controller');
const jwtService = require('@shared/services/jwt.service');

class UsersController extends CrudController {

  constructor(...args) {
    super(...args);
    this.jwt = jwtService;
  }

  async authenticate(req, res, next) {
    try {

      // Check credentials. If correct, user entity is returned
      const { username, password } = req.body;
      const user = await this.service.authenticate(username, password);
      if (!user) throw this.httpErrors.create(401, res.__('Invalid credentials'));

      // Create a new user token
      const payload = {};
      payload.username = user.username;
      const token = this.jwt.createToken(payload);

      res.json({
        success: true,
        message: this.successMessage(user.username, 'authenticated', res.__mf),
        result: {
          token,
          user: this.mapEntity(user)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {

      // Create a new user token
      const { user } = req;
      const payload = {};
      payload.username = user.username;
      const newToken = this.jwt.createToken(payload);

      res.json({
        success: true,
        message: this.successMessage(user.username, 'validated', res.__mf),
        result: {
          token: newToken,
          user: this.mapEntity(user)
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UsersController(usersService, 'users', 'username', {
  roles: ['admin'], // Only superadmins and admins can list, read, create, update, and delete
  additionalActions: [
    {
      name: 'authenticate',
      method: 'post',
      roles: ['any']
    },
    {
      name: 'refreshToken',
      method: 'get',
      roles: ['authenticated'],
      path: 'token'
    },
  ],
  mapEntity: function (user, req) {
    delete user.id;
    delete user.password;
    delete user.tenant;
    if (this.isApiSecured && !req.isSuperAdmin) delete user.tenantId;
    return user;
  }
});
