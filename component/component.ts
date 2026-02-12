import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";


interface ComponentArgs {
    content?: string | undefined
    versioning?: Partial<aws.s3.BucketVersioning>;
}

interface ComponentData {
    url: pulumi.Output<string>
}

export class Component extends pulumi.ComponentResource<ComponentData> {
    public readonly url: pulumi.Output<string>;
    constructor(name: string, args: ComponentArgs, opts?: pulumi.ComponentResourceOptions) {
        super("x:index:Component", name, {name, args, opts}, opts);

        const data: ComponentData = pulumi.output(this.getData());
        this.url = data.url;
        this.registerOutputs({
            "url": this.url
        })
    }

    protected async initialize(props: {
        name: string,
        args: ComponentArgs,
        opts: pulumi.ComponentResourceOptions
    }): Promise<ComponentData> {
        const {name, args} = props;

        const bucket = new aws.s3.Bucket(`${name}`, {}, {parent: this});

        const website = new aws.s3.BucketWebsiteConfiguration(`${name}`, {
            bucket: bucket.bucket,
            indexDocument: {
                suffix: "index.html"
            }
        }, {parent: this});

        const bucketContent = args.content !== undefined ? args.content : "Hello, World!";
        // const bucketContent = "Hello, World!"

        const content = new aws.s3.BucketObject(`${name}`, {
            bucket: bucket.bucket,
            content: bucketContent,
            key: "index.html",
            contentType: "text/html; charset=utf-8"
        }, {parent: this})

        if (args.versioning?.versioningConfiguration?.status !== undefined) {
            const versioning = new aws.s3.BucketVersioning(`${name}`, {
                bucket: bucket.bucket,
                versioningConfiguration: args.versioning.versioningConfiguration
            }, {parent: this})
        }

        const ownershipControls = new aws.s3.BucketOwnershipControls(`${name}`, {
            bucket: bucket.bucket,
            rule: {
                objectOwnership: "ObjectWriter"
            }
        }, {parent: this})

        const accessBlock = new aws.s3.BucketPublicAccessBlock(`${name}`, {
            bucket: bucket.bucket,
            blockPublicAcls: false
        }, {parent: this})

        const policy = new aws.s3.BucketPolicy(`${name}`, {
            bucket: bucket.bucket,
            policy: aws.iam.getPolicyDocumentOutput({
                version: "2012-10-17",
                statements: [{
                    effect: "Allow",
                    principals: [{
                        type: "AWS",
                        identifiers: ["*"]
                    }],
                    resources: [pulumi.interpolate`${bucket.arn}/*`],
                    actions: ["s3:GetObject"]
                }]
            }).json
        }, {dependsOn: [ownershipControls, accessBlock], parent: this})

        return {
            url: website.websiteEndpoint
        }
    }
}