import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy } from 'passport-azure-ad';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class AzureAdStrategy extends PassportStrategy(OIDCStrategy, 'azure-ad') {
    private readonly logger = new Logger(AzureAdStrategy.name);

    constructor(
        configService: ConfigService,
        private authService: AuthService,
    ) {
        const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
        const redirectUrl = configService.get('AZURE_REDIRECT_URL') || 'http://localhost:3001/auth/azure/callback';
        const isProduction = nodeEnv === 'production';
        const clientId = configService.get('AZURE_CLIENT_ID');
        const tenantId = configService.get('AZURE_TENANT_ID');

        // Only allow HTTP redirects in development
        // In production, HTTPS is required for security
        const allowHttp = !isProduction;

        const options = (clientId && tenantId) ? {
            identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
            clientID: clientId,
            responseType: 'code id_token',
            responseMode: 'form_post',
            redirectUrl: redirectUrl,
            allowHttpForRedirectUrl: allowHttp,
            clientSecret: configService.get('AZURE_CLIENT_SECRET'),
            validateIssuer: false, // Allow any tenant (multi-tenant app) or specific tenant
            passReqToCallback: false,
            scope: ['email', 'profile', 'openid'],
            loggingLevel: isProduction ? 'warn' : 'info',
            nonceLifetime: null,
            nonceMaxAmount: 5,
            useCookieInsteadOfSession: false,
            cookieEncryptionKeys: null,
        } : {
            identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
            clientID: '00000000-0000-0000-0000-000000000000',
            responseType: 'code id_token',
            responseMode: 'form_post',
            redirectUrl: redirectUrl,
            allowHttpForRedirectUrl: allowHttp,
            clientSecret: 'dummy',
            validateIssuer: false,
            passReqToCallback: false,
            scope: ['email', 'profile', 'openid'],
        };

        super(options);

        if (!clientId || !tenantId) {
            this.logger.warn('Azure AD configuration missing. Azure AD authentication will be disabled.');
        }
    }

    async validate(_iss: string, sub: string, profile: any, _jwtClaims: any, _accessToken: string, _refreshToken: string, _params: any) {
        // profile contains the user info from Azure AD
        // We need to find or create the user in our DB
        try {
            const user = await this.authService.validateAzureUser({
                oid: profile.oid || sub,
                email: profile.upn || profile.email, // upn is usually the email in Azure AD
                firstName: profile.name?.split(' ')[0] || profile.given_name || '',
                lastName: profile.name?.split(' ').slice(1).join(' ') || profile.family_name || '',
            });

            if (!user) {
                throw new UnauthorizedException('Access denied');
            }
            return user;
        } catch (error) {
            throw new UnauthorizedException('Authentication failed');
        }
    }
}
